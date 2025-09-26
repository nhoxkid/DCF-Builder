use rust_decimal::prelude::{FromPrimitive, ToPrimitive};
use rust_decimal::{Decimal, RoundingStrategy};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use wasm_bindgen::prelude::*;

const MICRO_SCALE: u32 = 6;
const MICROS_PER_UNIT: i128 = 1_000_000;

#[cfg(feature = "console_error_panic_hook")]
#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

#[derive(Debug, Error)]
enum EngineError {
    #[error("invalid money amount: {0}")]
    InvalidMoney(String),
    #[error("numeric overflow")]
    Overflow,
    #[error("serialization error: {0}")]
    Serialization(String),
}

impl From<EngineError> for JsValue {
    fn from(value: EngineError) -> Self {
        JsValue::from_str(&value.to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Money {
    pub micro: String,
}

impl Money {
    fn to_decimal(&self) -> Result<Decimal, EngineError> {
        let micro = self
            .micro
            .parse::<i128>()
            .map_err(|_| EngineError::InvalidMoney(self.micro.clone()))?;
        Ok(Decimal::from_i128_with_scale(micro, MICRO_SCALE as i32))
    }

    fn from_decimal(value: Decimal) -> Result<Self, EngineError> {
        let rounded = value.round_dp_with_strategy(MICRO_SCALE, RoundingStrategy::MidpointAwayFromZero);
        let multiplier = Decimal::from_i128(MICROS_PER_UNIT).ok_or(EngineError::Overflow)?;
        let micros = (rounded * multiplier)
            .round()
            .to_i128()
            .ok_or(EngineError::Overflow)?;
        Ok(Money {
            micro: micros.to_string(),
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Cashflow {
    pub date_epoch_days: i32,
    pub amount: Money,
}

#[derive(Debug, Clone, Serialize, Deserialize, Copy)]
#[serde(rename_all = "lowercase")]
pub enum Compounding {
    Annual,
    Monthly,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DcfInput {
    pub cashflows: Vec<Cashflow>,
    pub discount_rate_bps: i32,
    pub compounding: Compounding,
    pub as_of_epoch_days: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DcfOutput {
    pub npv: Money,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub irr_bps: Option<i32>,
}

#[wasm_bindgen]
pub struct WasmDcfEngine;

#[wasm_bindgen]
impl WasmDcfEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> WasmDcfEngine {
        WasmDcfEngine
    }

    pub fn npv(&self, input: JsValue) -> Result<JsValue, JsValue> {
        let parsed: DcfInput = input
            .into_serde()
            .map_err(|err| EngineError::Serialization(err.to_string()))?;

        let rate = parsed.discount_rate_bps as f64 / 10_000.0;
        let npv_decimal = npv_for_rate(&parsed, rate).map_err(JsValue::from)?;
        let npv_money = Money::from_decimal(npv_decimal).map_err(JsValue::from)?;
        let irr_bps = calculate_irr(&parsed).map_err(JsValue::from)?;

        let output = DcfOutput { npv: npv_money, irr_bps };
        JsValue::from_serde(&output)
            .map_err(|err| EngineError::Serialization(err.to_string()).into())
    }

    pub fn irr(&self, input: JsValue) -> Result<f64, JsValue> {
        let parsed: DcfInput = input
            .into_serde()
            .map_err(|err| EngineError::Serialization(err.to_string()))?;

        match calculate_irr(&parsed).map_err(JsValue::from)? {
            Some(bps) => Ok(bps as f64),
            None => Err(JsValue::from_str("IRR not found")),
        }
    }
}

fn calculate_irr(input: &DcfInput) -> Result<Option<i32>, EngineError> {
    if input.cashflows.is_empty() {
        return Ok(None);
    }

    let mut low = -0.9999_f64; // -99.99%
    let mut high = 10.0_f64; // 1000%
    let tolerance = Decimal::from_f64(1e-7).ok_or(EngineError::Overflow)?;

    let mut npv_low = npv_for_rate(input, low)?;
    let mut npv_high = npv_for_rate(input, high)?;

    let same_sign = (npv_low.is_sign_positive() && npv_high.is_sign_positive())
        || (npv_low.is_sign_negative() && npv_high.is_sign_negative());
    if same_sign {
        return Ok(None);
    }

    let max_iterations = 128;
    for _ in 0..max_iterations {
        let mid = (low + high) / 2.0;
        let npv_mid = npv_for_rate(input, mid)?;

        if npv_mid.abs() < tolerance {
            let bps = (mid * 10_000.0).round();
            return Ok(Some(clamp_to_i32(bps)));
        }

        if (npv_mid.is_sign_positive() && npv_low.is_sign_positive())
            || (npv_mid.is_sign_negative() && npv_low.is_sign_negative())
        {
            low = mid;
            npv_low = npv_mid;
        } else {
            high = mid;
            npv_high = npv_mid;
        }
    }

    let midpoint = (low + high) / 2.0;
    let bps = (midpoint * 10_000.0).round();
    Ok(Some(clamp_to_i32(bps)))
}

fn npv_for_rate(input: &DcfInput, annual_rate: f64) -> Result<Decimal, EngineError> {
    let mut total = Decimal::ZERO;
    let frequency = compounding_frequency(input.compounding);

    for cf in &input.cashflows {
        let amount = cf.amount.to_decimal()?;
        let periods = periods_between(input.as_of_epoch_days, cf.date_epoch_days, frequency);

        let rate_per_period = annual_rate / frequency;
        let base = 1.0 + rate_per_period;
        if base <= 0.0 {
            return Err(EngineError::Overflow);
        }

        let discount = base.powf(periods);
        if !discount.is_finite() || discount == 0.0 {
            return Err(EngineError::Overflow);
        }

        let discount_decimal = Decimal::from_f64(discount).ok_or(EngineError::Overflow)?;
        total += amount / discount_decimal;
    }

    Ok(total)
}

fn periods_between(as_of: i32, target: i32, frequency: f64) -> f64 {
    let delta_days = (target - as_of) as f64;
    delta_days / (365.0 / frequency)
}

fn compounding_frequency(compounding: Compounding) -> f64 {
    match compounding {
        Compounding::Annual => 1.0,
        Compounding::Monthly => 12.0,
    }
}

fn clamp_to_i32(value: f64) -> i32 {
    if value.is_nan() {
        0
    } else if value < i32::MIN as f64 {
        i32::MIN
    } else if value > i32::MAX as f64 {
        i32::MAX
    } else {
        value as i32
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn money_from_units(units: f64) -> Money {
        let micros = (units * MICROS_PER_UNIT as f64).round() as i128;
        Money {
            micro: micros.to_string(),
        }
    }

    fn sample_input() -> DcfInput {
        DcfInput {
            as_of_epoch_days: 18_250, // 2020-01-01 roughly
            discount_rate_bps: 800,   // 8%
            compounding: Compounding::Annual,
            cashflows: vec![
                Cashflow {
                    date_epoch_days: 18_250,
                    amount: money_from_units(-100.0),
                },
                Cashflow {
                    date_epoch_days: 18_615,
                    amount: money_from_units(60.0),
                },
                Cashflow {
                    date_epoch_days: 18_980,
                    amount: money_from_units(60.0),
                },
            ],
        }
    }

    #[test]
    fn npv_matches_expected() {
        let input = sample_input();
        let npv = npv_for_rate(&input, input.discount_rate_bps as f64 / 10_000.0).unwrap();
        let money = Money::from_decimal(npv).unwrap();
        assert!(money.micro.parse::<i128>().unwrap() < 0);
    }

    #[test]
    fn irr_exists_for_standard_project() {
        let input = sample_input();
        let irr = calculate_irr(&input).unwrap();
        assert!(irr.is_some());
    }
}

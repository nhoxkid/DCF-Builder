import type { DcfInput, DcfOutput } from "@dcf-builder/engine-contract";
import type { WasmModuleSource } from "../src/index";

declare function init(module?: WasmModuleSource): Promise<unknown>;

declare class WasmDcfEngine {
  npv(input: DcfInput): DcfOutput;
  irr(input: DcfInput): number;
}

export default init;
export { WasmDcfEngine };

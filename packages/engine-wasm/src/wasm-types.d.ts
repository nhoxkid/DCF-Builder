declare module '../pkg/dcf.js' {
  import type { DcfInput, DcfOutput } from '@dcf-builder/engine-contract';

  export default function init(module?: RequestInfo | URL | Response | BufferSource | WebAssembly.Module): Promise<void>;

  export class WasmDcfEngine {
    npv(input: DcfInput): DcfOutput;
    irr(input: DcfInput): number;
  }
}

declare module 'parquet-wasm' {
  export class ParquetReader {
    static openBuffer(data: Uint8Array): Promise<ParquetReader>;
    getRowCount(): number;
    getRow(index: number): Record<string, unknown>;
    close(): void;
  }
}

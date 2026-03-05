import { RawSignal } from '../models/types';

export interface Collector {
  id: string;
  collect(queries: string[]): Promise<RawSignal[]>;
}

// Feature Flag data model
export interface FeatureFlag {
  key: string;
  value: boolean | string | number;
  description?: string;
  updatedAt: Date;
}

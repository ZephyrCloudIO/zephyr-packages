export interface DelegateConfig {
  org: string;
  project: string;
  application?: undefined;
  target?: 'ios' | 'android' | 'web' | undefined;
}

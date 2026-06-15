/** Brand — spec 04-data-model.md. */

export interface Brand {
  id: string;
  name: string;
  country: string;
  logoUrl: string;
  story?: string;
  tier: 'flagship' | 'performance' | 'value';
}

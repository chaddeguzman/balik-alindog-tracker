/* global window */

export * from './src/lib/healthTrackApi.ts';
import * as HealthTrackApi from './src/lib/healthTrackApi.ts';

if (typeof window !== 'undefined') window.HealthTrackApi = HealthTrackApi;

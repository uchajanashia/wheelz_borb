import { registerLocaleData } from '@angular/common';
import localeKa from '@angular/common/locales/ka';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { TitleStrategy, provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { FitmentDataService } from '@core/services/fitment-data.service';
import { MockFitmentDataService } from '@core/services/mock-fitment-data.service';
import { AurenTitleStrategy } from '@core/auren-title.strategy';

registerLocaleData(localeKa);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideClientHydration(withEventReplay()),
    // Mock fixtures behind the abstract class token — swap to HttpFitmentDataService
    // later with zero component changes (spec 02).
    { provide: FitmentDataService, useClass: MockFitmentDataService },
    { provide: TitleStrategy, useClass: AurenTitleStrategy },
    { provide: LOCALE_ID, useValue: 'ka' },
  ],
};

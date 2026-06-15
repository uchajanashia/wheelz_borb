import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { parseLook } from '../services/look-url';
import { GarageService } from '../services/garage.service';

/**
 * Configurator requires a selected vehicle (spec 03/06): no car → guided
 * redirect to the Garage ("Whose wheels are we changing today?").
 *
 * Exception (spec 05 §6): a valid `?look=` share link carries its own trimId
 * and must restore the configuration pre-auth, even with an empty garage —
 * the configurator page hydrates the garage from the link.
 */
export const vehicleSelectedGuard: CanActivateFn = (route) => {
  const garage = inject(GarageService);
  const router = inject(Router);
  if (garage.hasVehicle() || parseLook(route.queryParamMap.get('look'))) {
    return true;
  }
  return router.createUrlTree(['/garage']);
};

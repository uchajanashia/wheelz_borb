import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { CartService } from '../services/cart.service';

/** Checkout requires a non-empty cart (spec 06). */
export const cartNotEmptyGuard: CanActivateFn = () => {
  const cart = inject(CartService);
  const router = inject(Router);
  return cart.isEmpty() ? router.createUrlTree(['/cart']) : true;
};

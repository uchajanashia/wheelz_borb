import { Routes } from '@angular/router';

import { cartNotEmptyGuard } from '@core/guards/cart-not-empty.guard';
import { vehicleSelectedGuard } from '@core/guards/vehicle-selected.guard';

/** All feature routes lazy-loaded (spec 03/06). Titles via AurenTitleStrategy. */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('@features/home/home.page').then((m) => m.HomePage),
    title: $localize`მთავარი`,
  },
  {
    path: 'garage',
    loadComponent: () => import('@features/garage/garage.page').then((m) => m.GaragePage),
    title: $localize`გარაჟი`,
  },
  {
    path: 'season',
    loadComponent: () => import('@features/season/season.page').then((m) => m.SeasonPage),
    title: $localize`სეზონი`,
  },
  {
    path: 'configurator',
    loadComponent: () =>
      import('@features/configurator/configurator.page').then((m) => m.ConfiguratorPage),
    canActivate: [vehicleSelectedGuard],
    title: $localize`კონფიგურატორი`,
  },
  {
    path: 'catalog',
    loadComponent: () => import('@features/catalog/catalog.page').then((m) => m.CatalogPage),
    title: $localize`კატალოგი`,
  },
  {
    path: 'tire/:id',
    loadComponent: () => import('@features/product/product.page').then((m) => m.ProductPage),
    title: $localize`საბურავი`,
  },
  {
    path: 'cart',
    loadComponent: () => import('@features/checkout/cart.page').then((m) => m.CartPage),
    title: $localize`კალათა`,
  },
  {
    path: 'checkout',
    loadComponent: () => import('@features/checkout/checkout.page').then((m) => m.CheckoutPage),
    canActivate: [cartNotEmptyGuard],
    title: $localize`შეკვეთის გაფორმება`,
  },
  {
    path: 'order/:id',
    loadComponent: () => import('@features/checkout/order.page').then((m) => m.OrderPage),
    title: $localize`შეკვეთა`,
  },
  {
    path: 'brands/:id',
    loadComponent: () => import('@features/brands/brand.page').then((m) => m.BrandPage),
    title: $localize`ბრენდი`,
  },
  { path: '**', redirectTo: '' },
];

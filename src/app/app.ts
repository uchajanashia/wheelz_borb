import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  PLATFORM_ID,
  inject,
  viewChild,
} from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';

import { ClimateService } from '@core/services/climate.service';
import { MotionService } from '@core/services/motion.service';
import { Footer } from './layout/footer/footer';
import { Header } from './layout/header/header';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Header, Footer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly motion = inject(MotionService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly overlay = viewChild.required<ElementRef<HTMLDivElement>>('routeOverlay');
  // Eagerly instantiate so the climate theme class is applied on <html> at bootstrap.
  private readonly climate = inject(ClimateService);

  constructor() {
    // A9 (spec 07): router-level 200 ms fade-through-dark via a plain overlay
    // div — no Angular animations API. Reduced motion → no transition at all.
    inject(Router).events.subscribe((event) => {
      if (!this.isBrowser || this.motion.reduced()) {
        return;
      }
      const el = this.overlay().nativeElement;
      if (event instanceof NavigationStart) {
        this.motion.to(el, { opacity: 1, duration: 0.1, ease: 'none', overwrite: true });
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.motion.to(el, { opacity: 0, duration: 0.1, delay: 0.05, ease: 'none', overwrite: true });
      }
    });
  }
}

import { Pipe, PipeTransform } from '@angular/core';

import { TireSize } from '@core/models';

/** { widthMm: 225, aspect: 45, rimDiameterInch: 18 } → "225/45 R18" */
@Pipe({ name: 'tireSize' })
export class TireSizePipe implements PipeTransform {
  transform(size: TireSize): string {
    return `${size.widthMm}/${size.aspect} R${size.rimDiameterInch}`;
  }
}

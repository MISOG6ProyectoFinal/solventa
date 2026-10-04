import { Injectable, signal } from '@angular/core';
import { Partner } from '../../../core/models/partner.model';
import { PARTNERS_DATA } from '../data/partners.data';

@Injectable({ providedIn: 'root' })
export class PartnersService {
  private readonly state = signal<Partner[]>(PARTNERS_DATA);
  
  readonly partners = this.state.asReadonly();

  findById(id: string | null): Partner | null {
    if (!id) return null;
    return this.state().find(p => p.id === id) ?? null;
  }

  addPartner(partner: Partner): void {
    this.state.update(partners => [partner, ...partners]);
  }

  updatePartner(updated: Partner): void {
    this.state.update(partners => partners.map(p => p.id === updated.id ? updated : p));
  }
}

export type VehicleStatus = 'active' | 'sold' | 'archived';

export interface VehicleDetails {
  purchaseDate: string;
  vin: string;
  engine: string;
  chassis: string;
  odometer: string;
  fuelType: string;
  transmission: string;
  grossVehicleMass: string;
  notes: string;
}

export interface MaintenanceRecord {
  id: string;
  date: string;
  enteredBy: string;
  work: string;
  odoReading: string;
  performedAt: string;
  outcome: string;
  cost: string;
  notes: string;
  locked: boolean;
}

export interface Vehicle {
  id: string;
  location: string;
  name: string;
  licensePlate: string;
  status: VehicleStatus;
  details: VehicleDetails;
  maintenance: MaintenanceRecord[];
}

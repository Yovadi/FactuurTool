import { SpaceManagement } from './SpaceManagement';

export function SpacesTabs() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Kantoor Beheer</h2>
      </div>
      <SpaceManagement />
    </div>
  );
}

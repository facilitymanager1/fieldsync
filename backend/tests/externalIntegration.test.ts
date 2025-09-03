// Basic test for external integration module
import { syncWithHRSystem, syncWithPayrollSystem } from '../modules/externalIntegration';

describe('External Integration', () => {
  it('should sync with HR system', async () => {
    const res = await syncWithHRSystem({ name: 'Test Staff' });
    expect(res.success).toBe(true);
  });
  it('should sync with Payroll system', async () => {
    const res = await syncWithPayrollSystem({ staffId: 's1', amount: 100 });
    expect(res.success).toBe(true);
  });
});

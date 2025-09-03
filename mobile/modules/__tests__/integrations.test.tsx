// Tests for Integrations module
import React from 'react';
import { render } from '@testing-library/react-native';
import { CRMIntegration, CalendarIntegration, FuelCardIntegration, IoTIntegrationMobile, AnalyticsIntegration } from '../integrations';

describe('Integrations', () => {
  it('renders CRMIntegration placeholder', () => {
    const { getByText } = render(<CRMIntegration />);
    expect(getByText('CRM Integration (Coming Soon)')).toBeTruthy();
  });
  it('renders CalendarIntegration placeholder', () => {
    const { getByText } = render(<CalendarIntegration />);
    expect(getByText('Calendar Integration (Coming Soon)')).toBeTruthy();
  });
  it('renders FuelCardIntegration placeholder', () => {
    const { getByText } = render(<FuelCardIntegration />);
    expect(getByText('Fuel Card Integration (Coming Soon)')).toBeTruthy();
  });
  it('renders IoTIntegrationMobile placeholder', () => {
    const { getByText } = render(<IoTIntegrationMobile />);
    expect(getByText('IoT Integration (Mobile, Coming Soon)')).toBeTruthy();
  });
  it('renders AnalyticsIntegration placeholder', () => {
    const { getByText } = render(<AnalyticsIntegration />);
    expect(getByText('Analytics Integration (Coming Soon)')).toBeTruthy();
  });
});

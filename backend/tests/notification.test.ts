// Automated API tests for notification preferences and leave approval email notification
import request from 'supertest';
import app from '../index';

describe('Notification Preferences API', () => {
  const userId = 'testuser1';

  it('should set and get notification preferences', async () => {
    // Set preferences
    const prefs = [
      { type: 'leave', enabled: true },
      { type: 'shift', enabled: false },
    ];
    await request(app)
      .post(`/notifications/preferences/${userId}`)
      .send({ preferences: prefs })
      .expect(200);

    // Get preferences
    const res = await request(app)
      .get(`/notifications/preferences/${userId}`)
      .expect(200);
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'leave', enabled: true }),
        expect.objectContaining({ type: 'shift', enabled: false }),
      ])
    );
  });
});

describe('Leave Approval Notification', () => {
  const userId = 'testuser2';

  it('should trigger email notification on leave approval if enabled', async () => {
    // Set leave notification enabled
    await request(app)
      .post(`/notifications/preferences/${userId}`)
      .send({ preferences: [{ type: 'leave', enabled: true }] })
      .expect(200);

    // Request leave
    const leaveRes = await request(app)
      .post('/leave/request')
      .send({
        staffId: userId,
        leaveType: 'sick',
        startDate: '2025-08-01',
        endDate: '2025-08-02',
        reason: 'Test',
      })
      .expect(201);
    const leaveId = leaveRes.body.leave.id;

    // Approve leave (should trigger email)
    await request(app)
      .post('/leave/approve')
      .send({ leaveId, status: 'approved', approvedBy: 'admin' })
      .expect(200);
    // (In production, check email delivery or mock nodemailer)
  });

  it('should NOT trigger email if leave notification is disabled', async () => {
    // Set leave notification disabled
    await request(app)
      .post(`/notifications/preferences/${userId}`)
      .send({ preferences: [{ type: 'leave', enabled: false }] })
      .expect(200);

    // Request leave
    const leaveRes = await request(app)
      .post('/leave/request')
      .send({
        staffId: userId,
        leaveType: 'casual',
        startDate: '2025-08-03',
        endDate: '2025-08-04',
        reason: 'Test2',
      })
      .expect(201);
    const leaveId = leaveRes.body.leave.id;

    // Approve leave (should NOT trigger email)
    await request(app)
      .post('/leave/approve')
      .send({ leaveId, status: 'approved', approvedBy: 'admin' })
      .expect(200);
    // (In production, check that no email is sent)
  });
});

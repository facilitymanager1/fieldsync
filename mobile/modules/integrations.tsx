import React, { useState, useEffect } from 'react';
import { View, Text, Button, FlatList, ActivityIndicator, Alert } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import { useAuthRequest, makeRedirectUri, ResponseType } from 'expo-auth-session';

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send';
const ZOHO_MAIL_SCOPE = 'ZohoMail.messages.ALL';
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const ZOHO_CLIENT_ID = 'YOUR_ZOHO_CLIENT_ID';
const ZOHO_REDIRECT_URI = 'YOUR_APP_REDIRECT_URI';

export function EmailIntegration() {
  const [email, setEmail] = useState<string | null>(null);
  const [provider, setProvider] = useState<'google' | 'zoho' | null>(null);

  // Google Email OAuth2 config
  const [googleEmailRequest, googleEmailResponse, promptGoogleEmail] = useAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    scopes: GMAIL_SCOPE.split(' '),
    redirectUri: makeRedirectUri(),
    responseType: ResponseType.Token,
  }, { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth' });

  useEffect(() => {
    if (googleEmailResponse?.type === 'success' && googleEmailResponse.authentication?.accessToken) {
      setProvider('google');
      fetchGoogleEmail(googleEmailResponse.authentication.accessToken);
    }
  }, [googleEmailResponse]);

  function connectGoogleEmail() {
    promptGoogleEmail();
  }

  async function fetchGoogleEmail(token: string) {
    const res = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setEmail(data.emailAddress || null);
  }

  // Zoho Email OAuth2 config
  const [zohoEmailRequest, zohoEmailResponse, promptZohoEmail] = useAuthRequest({
    clientId: ZOHO_CLIENT_ID,
    scopes: [ZOHO_MAIL_SCOPE],
    redirectUri: ZOHO_REDIRECT_URI,
    responseType: ResponseType.Token,
  }, { authorizationEndpoint: 'https://accounts.zoho.com/oauth/v2/auth' });

  useEffect(() => {
    if (zohoEmailResponse?.type === 'success' && zohoEmailResponse.authentication?.accessToken) {
      setProvider('zoho');
      fetchZohoEmail(zohoEmailResponse.authentication.accessToken);
    }
  }, [zohoEmailResponse]);

  function connectZohoEmail() {
    promptZohoEmail();
  }

  async function fetchZohoEmail(token: string) {
    const res = await fetch('https://mail.zoho.com/api/accounts', {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    const data = await res.json();
    setEmail(data.data?.[0]?.primaryEmailAddress || null);
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 8 }}>Email Integration</Text>
      <Button title="Connect Google Email" onPress={connectGoogleEmail} />
      <View style={{ height: 8 }} />
      <Button title="Connect Zoho Mail" onPress={connectZohoEmail} />
      {email && (
        <Text style={{ marginTop: 16 }}>Connected as: {email} ({provider})</Text>
      )}
    </View>
  );
}

// Notification Preferences UI
const NOTIFICATION_TYPES = [
  { key: 'shift', label: 'Shift Updates' },
  { key: 'leave', label: 'Leave Approvals' },
  { key: 'ticket', label: 'Ticket Updates' },
  { key: 'meeting', label: 'Meeting Reminders' },
  { key: 'custom', label: 'Custom Alerts' },
];

export function NotificationPreferences({ isAdmin = false, userId }: { isAdmin?: boolean, userId?: string }) {
  const [prefs, setPrefs] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load preferences from backend
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`http://localhost:3001/notifications/preferences/${userId}`)
      .then(res => res.json())
      .then(data => {
        // Convert array to object for UI
        const obj: { [key: string]: boolean } = {};
        data.forEach((p: any) => { obj[p.type] = p.enabled; });
        setPrefs(obj);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  function togglePref(key: string) {
    setPrefs(p => ({ ...p, [key]: !p[key] }));
  }

  // Save preferences to backend
  function savePrefs() {
    if (!userId) return;
    setSaving(true);
    const arr = Object.entries(prefs).map(([type, enabled]) => ({ type, enabled }));
    fetch(`http://localhost:3001/notifications/preferences/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: arr }),
    })
      .then(res => res.json())
      .then(() => setSaving(false))
      .catch(() => setSaving(false));
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 8 }}>Notification Preferences</Text>
      <Text style={{ marginBottom: 8 }}>
        {isAdmin
          ? 'Set which notifications are sent via email for all users.'
          : 'Choose which notifications you want to receive via email.'}
      </Text>
      {loading ? <ActivityIndicator /> : NOTIFICATION_TYPES.map(nt => (
        <View key={nt.key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ flex: 1 }}>{nt.label}</Text>
          <Button
            title={prefs[nt.key] ? 'Enabled' : 'Disabled'}
            onPress={() => togglePref(nt.key)}
            color={prefs[nt.key] ? 'green' : 'gray'}
          />
        </View>
      ))}
      <Button title={saving ? 'Saving...' : 'Save Preferences'} onPress={savePrefs} disabled={saving || loading} />
    </View>
  );
}
// Integration Points module for FieldSync Mobile
// CRM, Calendar, Fuel Cards, IoT, Analytics integrations


export function CRMIntegration() {
  useEffect(() => {
    // TODO: Connect to Salesforce/Zoho APIs
  }, []);
  return <View><Text>CRM Integration (Coming Soon)</Text></View>;
}

export function CalendarIntegration() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Google Calendar OAuth2 config
  const [googleCalRequest, googleCalResponse, promptGoogleCal] = useAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    redirectUri: makeRedirectUri(),
    responseType: ResponseType.Token,
  }, { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth' });

  useEffect(() => {
    if (googleCalResponse?.type === 'success' && googleCalResponse.authentication?.accessToken) {
      fetchGoogleEvents(googleCalResponse.authentication.accessToken);
    }
  }, [googleCalResponse]);

  function connectGoogle() {
    promptGoogleCal();
  }

  async function fetchGoogleEvents(token: string) {
    setLoading(true);
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setEvents(data.items || []);
    setLoading(false);
  }

  // Zoho Calendar OAuth2 config
  const [zohoCalRequest, zohoCalResponse, promptZohoCal] = useAuthRequest({
    clientId: ZOHO_CLIENT_ID,
    scopes: ['ZohoCalendar.events.ALL'],
    redirectUri: ZOHO_REDIRECT_URI,
    responseType: ResponseType.Token,
  }, { authorizationEndpoint: 'https://accounts.zoho.com/oauth/v2/auth' });

  useEffect(() => {
    if (zohoCalResponse?.type === 'success' && zohoCalResponse.authentication?.accessToken) {
      fetchZohoEvents(zohoCalResponse.authentication.accessToken);
    }
  }, [zohoCalResponse]);

  function connectZoho() {
    promptZohoCal();
  }

  async function fetchZohoEvents(token: string) {
    setLoading(true);
    // Example Zoho Calendar API call (update as per Zoho docs)
    const res = await fetch('https://calendar.zoho.com/api/v1/calendars/primary/events', {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    const data = await res.json();
    setEvents(data.events || []);
    setLoading(false);
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 8 }}>Calendar Integration</Text>
      <Button title="Connect Google Calendar" onPress={connectGoogle} />
      <View style={{ height: 8 }} />
      <Button title="Connect Zoho Calendar" onPress={connectZoho} />
      {loading && <ActivityIndicator style={{ margin: 16 }} />}
      <FlatList
        data={events}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={{ padding: 8, borderBottomWidth: 1, borderColor: '#eee' }}>
            <Text>{item.summary || item.title}</Text>
            <Text style={{ color: '#888' }}>{item.start?.dateTime || item.start?.date}</Text>
          </View>
        )}
      />
    </View>
  );
}

export function FuelCardIntegration() {
  useEffect(() => {
    // TODO: Connect to fuel card vendor APIs
  }, []);
  return <View><Text>Fuel Card Integration (Coming Soon)</Text></View>;
}

export function IoTIntegrationMobile() {
  useEffect(() => {
    // TODO: Connect to IoT sensors (mobile)
  }, []);
  return <View><Text>IoT Integration (Mobile, Coming Soon)</Text></View>;
}

export function AnalyticsIntegration() {
  useEffect(() => {
    // TODO: Integrate Segment/Amplitude/Datadog SDKs
  }, []);
  return <View><Text>Analytics Integration (Coming Soon)</Text></View>;
}

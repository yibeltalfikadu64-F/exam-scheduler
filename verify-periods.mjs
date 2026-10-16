const BASE = 'http://localhost:5000/api/v1';

async function call(method, path, { token, body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let json = null;
  try {
    json = await response.json();
  } catch {}

  return { status: response.status, json };
}

const login = await call('POST', '/auth/login', {
  body: {
    username: 'admin',
    password: 'Admin@12345',
  },
});

if (login.status < 200 || login.status >= 300 || !login.json?.data?.token) {
  console.log('Login failed:', login.status, login.json?.message || login.json);
  process.exitCode = 1;
} else {
  const token = login.json.data.token;
  let createdId;

  try {
    const created = await call('POST', '/exam-periods', {
      token,
      body: {
        name: `ZZ CRUD Test ${Date.now()}`,
        term: 'ZZTest',
        startDate: '2099-02-01',
        endDate: '2099-02-20',
        status: 'draft',
      },
    });

    console.log('CREATE:', created.status, created.json?.message || '');

    const record = created.json?.data;
    createdId = record?.id ?? record?.examPeriod?.id;

    if (!createdId) {
      console.log('Could not identify created ID. Response:', created.json);
    } else {
      console.log('Created ID:', createdId);

      const updated = await call('PATCH', `/exam-periods/${createdId}`, {
        token,
        body: { name: 'ZZ CRUD Test Updated' },
      });
      console.log('UPDATE:', updated.status, updated.json?.message || '');

      const status = await call('PATCH', `/exam-periods/${createdId}/status`, {
        token,
        body: { status: 'open' },
      });
      console.log('STATUS:', status.status, status.json?.message || '');

      // Delete only the record created by this test.
      const deleted = await call('DELETE', `/exam-periods/${createdId}`, {
        token,
      });
      console.log('DELETE:', deleted.status, deleted.json?.message || '');
    }
  } catch (error) {
    console.error('Request failed:', error.message);
    console.log('If a test record was created, its ID may be:', createdId);
  }
}
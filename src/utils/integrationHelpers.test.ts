import {
  isEBoekhoudenActive,
  isRemoteRecordMissing,
  parseFunctionJson,
} from './integrationHelpers';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function run() {
  assert(!isEBoekhoudenActive(null), 'null settings are inactive');
  assert(
    !isEBoekhoudenActive({ eboekhouden_connected: true, eboekhouden_api_token: 'tok' }),
    'connected without enabled is inactive'
  );
  assert(
    !isEBoekhoudenActive({
      eboekhouden_enabled: true,
      eboekhouden_connected: true,
      eboekhouden_api_token: '',
    }),
    'enabled without token is inactive'
  );
  assert(
    isEBoekhoudenActive({
      eboekhouden_enabled: true,
      eboekhouden_connected: true,
      eboekhouden_api_token: 'tok',
    }),
    'enabled + connected + token is active'
  );

  assert(!isRemoteRecordMissing({ success: true, status: 200 }), 'success is not missing');
  assert(
    !isRemoteRecordMissing({ success: false, status: 500, error: 'timeout' }),
    '500 timeout must not clear sync IDs'
  );
  assert(
    isRemoteRecordMissing({ success: false, status: 404 }),
    'HTTP 404 is missing'
  );
  assert(
    isRemoteRecordMissing({ success: false, status: 200, data: { title: 'Not Found' } }),
    'Not Found payload is missing'
  );

  const ok = await parseFunctionJson(
    new Response(JSON.stringify({ success: true, messageId: 'abc' }), { status: 200 })
  );
  assert(ok.success === true && ok.messageId === 'abc', 'JSON success is parsed');

  const html = await parseFunctionJson(
    new Response('<html>gateway timeout</html>', { status: 504 })
  );
  assert(html.success === false && html.error?.includes('504'), 'HTML error is not treated as success');

  const failBody = await parseFunctionJson(
    new Response(JSON.stringify({ success: false, error: 'SMTP auth failed' }), { status: 400 })
  );
  assert(failBody.success === false && failBody.error === 'SMTP auth failed', 'JSON error is forwarded');

  console.log('integrationHelpers tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

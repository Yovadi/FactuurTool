function App() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#1f2937',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '20px'
    }}>
      <h1 style={{ color: 'white', fontSize: '48px', fontWeight: 'bold' }}>
        HAL5 Overloon
      </h1>
      <p style={{ color: '#9ca3af', fontSize: '24px' }}>
        Facturatie Systeem
      </p>
      <div style={{
        backgroundColor: '#fbbf24',
        color: '#1f2937',
        padding: '12px 24px',
        borderRadius: '8px',
        fontWeight: '600'
      }}>
        ✓ Applicatie werkt!
      </div>
    </div>
  );
}

export default App;

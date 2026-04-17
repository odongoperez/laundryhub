export const metadata = {
  title: 'LaundryHub',
  description: 'Shared washing machine control',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0e0e0e', color: '#e8e6e3', minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  );
}

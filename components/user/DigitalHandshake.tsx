import { QRCodeSVG } from 'qrcode.react';

type DigitalHandshakeProps = {
  token: string;
  title?: string;
  subtitle?: string;
};

export function DigitalHandshake({ token, title = 'Express Drop-off QR', subtitle = 'Show this code or token at handoff.' }: DigitalHandshakeProps) {
  return (
    <div
      className="vc"
      style={{
        marginTop: 12,
        borderRadius: 18,
        borderColor: 'rgba(0,82,204,.22)',
        background: 'linear-gradient(180deg, rgba(0,82,204,0.08), rgba(0,109,55,0.05))',
      }}
    >
      <div className="vn" style={{ fontSize: 16 }}>
        {title}
      </div>
      <p className="vd" style={{ marginBottom: 12 }}>
        {subtitle}
      </p>
      <div
        style={{
          width: 'fit-content',
          margin: '0 auto 10px',
          padding: 10,
          borderRadius: 12,
          background: '#fff',
          border: '1px solid rgba(0,82,204,.2)',
        }}
      >
        <QRCodeSVG value={token} size={168} level="M" includeMargin />
      </div>
      <p className="vd" style={{ textAlign: 'center', fontSize: 13, marginBottom: 0 }}>
        Token Number: <strong>#{token}</strong>
      </p>
    </div>
  );
}

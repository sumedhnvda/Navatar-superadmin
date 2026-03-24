

export default function AdminLayout({ children }) {
  return (
    <div style={{ minHeight: "100vh" }}>
      <main
        className="main-content"
        style={{
          minHeight: "100vh",
          background: "#f8fafc",
        }}
      >
        <div style={{ padding: "28px 32px", width: "100%" }}>
          {children}
        </div>
      </main>
    </div>
  );
}

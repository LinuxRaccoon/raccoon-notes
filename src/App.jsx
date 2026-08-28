import {
  SignedIn,
  SignedOut,
  SignIn,
  UserButton,
  useUser,
} from "@clerk/clerk-react";

function SignedInHome() {
  const { user } = useUser();
  return (
    <div style={{ padding: 40, fontFamily: "system-ui" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontFamily: "Georgia, serif" }}>🦝 Raccoon Notes</h1>
        <UserButton afterSignOutUrl="/" />
      </div>
      <p>
        Signed in as <strong>{user?.primaryEmailAddress?.emailAddress}</strong>
      </p>
      <p style={{ color: "#7C7669" }}>
        Auth is wired up. Folders and notes come next once the database is
        connected.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <>
      <SignedOut>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "100vh",
            background: "#F7F4EE",
          }}
        >
          <SignIn routing="hash" />
        </div>
      </SignedOut>
      <SignedIn>
        <SignedInHome />
      </SignedIn>
    </>
  );
}

export default function NestedRouteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <p>nested route test</p>
      {children}
    </>
  )
}

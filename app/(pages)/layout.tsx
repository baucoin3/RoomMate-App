import { NavbarProvider } from '@/lib/context/navbar-context'

export default function PagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <NavbarProvider>
      {children}
    </NavbarProvider>
  )
}

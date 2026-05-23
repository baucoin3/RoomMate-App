interface ErrorBannerProps {
  message: string
}

export default function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) return null

  return (
    <div
      role="alert"
      className="fixed top-0 inset-x-0 z-50 bg-red-600 text-white text-sm font-medium px-4 py-3 text-center shadow-md"
    >
      {message}
    </div>
  )
}

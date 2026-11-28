const PATHS = {
  mic: 'M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3',
  stop: 'M7 7h10v10H7z',
  send: 'M5 12h14M13 6l6 6-6 6',
  sound: 'M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  check: 'm5 12 5 5 9-10',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01',
  down: 'm6 9 6 6 6-6',
  lock: 'M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1ZM8 11V8a4 4 0 0 1 8 0v3',
  alert: 'M12 4 2.5 20h19L12 4ZM12 10v4M12 17h.01',
  palette: 'M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.8 0-.9-.6-1.2-.6-2 0-.9.7-1.5 1.600-1.5H17a4 4 0 0 0 4-4C21 6.8 17 3 12 3ZM7.5 11.5h.01M10 7.500h.01M15 7.500h.01',
  again: 'M4 12a8 8 0 1 0 2.5-5.8M4 4v5h5',
}

export default function Icon({ name, className = 'size-5' }: { name: keyof typeof PATHS; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`${className} shrink-0 fill-none stroke-current stroke-2`} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  )
}

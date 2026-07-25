interface UserMenuProps {
  username: string
  onLogout: () => void
}

const UserMenu = ({ username, onLogout }: UserMenuProps) => {
  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 py-1.5 pl-3 pr-1.5 text-sm sm:gap-3 sm:pl-4">
      <div className="text-right">
        <p className="font-medium text-slate-100">{username}</p>
        <p className="hidden text-xs text-slate-400 sm:block">Your cities are saved to your account</p>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="rounded-full bg-slate-700 px-3 py-1.5 font-medium text-slate-200 transition hover:bg-slate-600"
      >
        Log Out
      </button>
    </div>
  )
}

export default UserMenu

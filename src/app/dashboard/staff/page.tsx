import { redirect } from 'next/navigation'

export default function StaffRouteRedirect() {
  redirect('/dashboard/super-admin')
}
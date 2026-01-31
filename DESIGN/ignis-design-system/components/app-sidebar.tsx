"use client"

import {
  Calendar,
  Home,
  Users,
  FileText,
  Settings,
  Bell,
  Activity,
  Clock,
  Search,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const mainNavItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Patienten",
    url: "/patienten",
    icon: Users,
    badge: "248",
  },
  {
    title: "Termine",
    url: "/termine",
    icon: Calendar,
  },
  {
    title: "Wartezimmer",
    url: "/wartezimmer",
    icon: Clock,
    badge: "3",
  },
]

const clinicalNavItems = [
  {
    title: "Triage",
    url: "/triage",
    icon: Activity,
    badge: "2",
    badgeVariant: "destructive" as const,
  },
  {
    title: "Dokumente",
    url: "/dokumente",
    icon: FileText,
  },
]

const systemNavItems = [
  {
    title: "Benachrichtigungen",
    url: "/benachrichtigungen",
    icon: Bell,
    badge: "5",
  },
  {
    title: "Einstellungen",
    url: "/einstellungen",
    icon: Settings,
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold">Ignis</span>
            <span className="text-xs text-muted-foreground">Praxismanagement</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                  >
                    <Link href={item.url}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.badge && (
                    <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Klinisch</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {clinicalNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                  >
                    <Link href={item.url}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.badge && (
                    <SidebarMenuBadge
                      className={
                        item.badgeVariant === "destructive"
                          ? "bg-destructive text-destructive-foreground rounded-full"
                          : ""
                      }
                    >
                      {item.badge}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                  >
                    <Link href={item.url}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.badge && (
                    <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
              MS
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium">Dr. Maria Schmidt</span>
            <span className="text-xs text-muted-foreground">Allgemeinmedizin</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

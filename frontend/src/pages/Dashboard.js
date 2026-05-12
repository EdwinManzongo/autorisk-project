import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  LogOut, ShieldCheck, LayoutDashboard, Users, Car, FileText,
  Calculator, BarChart3, Brain, UserCog, ClipboardList, Activity,
} from 'lucide-react';
import Overview from '@/components/admin/Overview';
import CustomerManagement from '@/components/admin/CustomerManagement';
import VehicleManagement from '@/components/admin/VehicleManagement';
import PremiumCalculator from '@/components/admin/PremiumCalculator';
import QuoteHistory from '@/components/admin/QuoteHistory';
import PolicyManagement from '@/components/admin/PolicyManagement';
import Reports from '@/components/admin/Reports';
import ModelInsights from '@/components/admin/ModelInsights';
import TelematicsManagement from '@/components/admin/TelematicsManagement';
import UsersManagement from '@/components/admin/UsersManagement';

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const isAdmin = user?.role === 'admin';

  const tabs = [
    { value: 'overview', label: 'Overview', icon: LayoutDashboard, show: true },
    { value: 'calculator', label: 'Calculator', icon: Calculator, show: true },
    { value: 'quotes', label: 'Quotes', icon: ClipboardList, show: true },
    { value: 'policies', label: 'Policies', icon: FileText, show: true },
    { value: 'customers', label: 'Customers', icon: Users, show: true },
    { value: 'vehicles', label: 'Vehicles', icon: Car, show: true },
    { value: 'telematics', label: 'Telematics', icon: Activity, show: true },
    { value: 'reports', label: 'Reports', icon: BarChart3, show: true },
    { value: 'model', label: 'AI Model', icon: Brain, show: isAdmin },
    { value: 'users', label: 'Users', icon: UserCog, show: isAdmin },
  ].filter(t => t.show);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-blue-900 text-white sticky top-0 z-10 shadow-lg">
        <div className="max-w-full px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-blue-900" />
              </div>
              <div>
                <h1 className="text-xl font-bold">AutoRisk Premium Optimizer</h1>
                <p className="text-xs text-blue-300">Hybrid DL + Gradient Boosting · Dynamic Insurance Pricing</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{user?.full_name}</p>
                <p className="text-xs text-blue-300 capitalize">{user?.role}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onLogout}
                className="text-blue-900 border-white bg-white hover:bg-blue-50"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full px-4 sm:px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap gap-1 h-auto bg-white border border-gray-200 p-1 rounded-lg shadow-sm">
            {tabs.map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-1.5 text-xs data-[state=active]:bg-blue-900 data-[state=active]:text-white"
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview"><Overview /></TabsContent>
          <TabsContent value="calculator"><PremiumCalculator user={user} onQuoteCreated={() => setActiveTab('quotes')} /></TabsContent>
          <TabsContent value="quotes"><QuoteHistory /></TabsContent>
          <TabsContent value="policies"><PolicyManagement /></TabsContent>
          <TabsContent value="customers"><CustomerManagement /></TabsContent>
          <TabsContent value="vehicles"><VehicleManagement /></TabsContent>
          <TabsContent value="telematics"><TelematicsManagement /></TabsContent>
          <TabsContent value="reports"><Reports /></TabsContent>
          <TabsContent value="model"><ModelInsights /></TabsContent>
          <TabsContent value="users"><UsersManagement /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

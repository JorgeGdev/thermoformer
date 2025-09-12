import React, { useState } from 'react';
import { 
  Home, 
  Package, 
  ArrowDownToLine, 
  FileText, 
  Plus, 
  MessageSquare, 
  BarChart3, 
  SendIcon,
  Boxes
} from 'lucide-react';

const navigationItems = [
  { href: '/', icon: Home, label: 'Home', color: 'blue' },
  { href: '/raw-pallets', icon: Package, label: 'Raw Stock', color: 'green' },
  { href: '/intake', icon: ArrowDownToLine, label: 'Intake', color: 'purple' },
  { href: '/iso', icon: FileText, label: 'Get ISO', color: 'orange' },
  { href: '/get-new-pallet', icon: Boxes, label: 'New Pallet', color: 'cyan' },
  { href: '/get-db-chat', icon: MessageSquare, label: 'THERMO Chat', color: 'pink' },
  { href: '/dispatch-pallets', icon: SendIcon, label: 'Dispatch Pallets', color: 'blue' },
  { href: '/stats', icon: BarChart3, label: 'Stats', color: 'indigo' },
];

const colorVariants = {
  blue: 'hover:bg-blue-500 hover:text-white focus:bg-blue-500 focus:text-white',
  green: 'hover:bg-green-500 hover:text-white focus:bg-green-500 focus:text-white',
  purple: 'hover:bg-purple-500 hover:text-white focus:bg-purple-500 focus:text-white',
  orange: 'hover:bg-orange-500 hover:text-white focus:bg-orange-500 focus:text-white',
  cyan: 'hover:bg-cyan-500 hover:text-white focus:bg-cyan-500 focus:text-white',
  pink: 'hover:bg-pink-500 hover:text-white focus:bg-pink-500 focus:text-white',
  indigo: 'hover:bg-indigo-500 hover:text-white focus:bg-indigo-500 focus:text-white',
};

export default function IconNavigation() {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <nav className="px-2 py-4">
      <div className="grid grid-cols-2 gap-3">
        {navigationItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <a
              key={item.href}
              href={item.href}
              className={`
                relative group flex flex-col items-center justify-center
                p-4 rounded-xl transition-all duration-200 ease-in-out
                bg-slate-50 dark:bg-slate-700/50 
                border border-slate-200 dark:border-slate-600
                ${colorVariants[item.color as keyof typeof colorVariants]}
                transform hover:scale-105 focus:scale-105
                hover:shadow-lg focus:shadow-lg
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400
                active:scale-95
              `}
              onMouseEnter={() => setHoveredItem(item.href)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <IconComponent 
                size={24} 
                className="mb-2 transition-transform duration-200 group-hover:scale-110" 
              />
              <span className="text-xs font-medium text-center leading-tight">
                {item.label}
              </span>
              
              {/* Tooltip for mobile/touch devices */}
              <div className={`
                absolute -top-12 left-1/2 transform -translate-x-1/2
                bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-800
                px-2 py-1 rounded text-xs whitespace-nowrap
                opacity-0 pointer-events-none transition-opacity duration-200
                ${hoveredItem === item.href ? 'opacity-100' : ''}
                before:content-[''] before:absolute before:top-full before:left-1/2 
                before:transform before:-translate-x-1/2 before:border-4 
                before:border-transparent before:border-t-slate-800 
                dark:before:border-t-slate-200
              `}>
                {item.label}
              </div>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

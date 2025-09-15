import React, { useState } from 'react';
import "../styles/global.css";  // 
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
  { href: '/', icon: Home, label: 'Home', color: 'primary' },
  { href: '/raw-pallets', icon: Package, label: 'Raw Stock', color: 'secondary' },
  { href: '/intake', icon: ArrowDownToLine, label: 'Intake', color: 'primary' },
  { href: '/iso', icon: FileText, label: 'Get ISO', color: 'secondary' },
  { href: '/get-new-pallet', icon: Boxes, label: 'New Pallet', color: 'primary' },
  { href: '/get-db-chat', icon: MessageSquare, label: 'THERMO Chat', color: 'secondary' },
  { href: '/dispatch-pallets', icon: SendIcon, label: 'Dispatch Pallets', color: 'primary' },
  { href: '/stats', icon: BarChart3, label: 'Stats', color: 'secondary' },
];

const colorVariants = {
  primary: 'hover:bg-slate-600 hover:text-white focus:bg-slate-600 focus:text-white',
  secondary: 'hover:bg-slate-500 hover:text-white focus:bg-slate-500 focus:text-white',
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
                bg-slate-100 dark:bg-slate-800
                text-slate-700 dark:text-slate-200
                border border-slate-300 dark:border-slate-700
                ${colorVariants[item.color as keyof typeof colorVariants]}
                transform hover:scale-105 focus:scale-105
                hover:shadow-lg focus:shadow-lg
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400
                active:scale-95
              `}
              onMouseEnter={() => setHoveredItem(item.href)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <IconComponent 
                size={24} 
                className="mb-2 transition-transform duration-200 group-hover:scale-110 text-current" 
              />
              <span className="text-xs font-medium text-center leading-tight text-current">
                {item.label}
              </span>
              
              {/* Tooltip for mobile/touch devices */}
              <div className={`
                absolute -top-12 left-1/2 transform -translate-x-1/2
                bg-slate-700 dark:bg-slate-600 text-white
                px-2 py-1 rounded text-xs whitespace-nowrap
                opacity-0 pointer-events-none transition-opacity duration-200
                ${hoveredItem === item.href ? 'opacity-100' : ''}
                before:content-[''] before:absolute before:top-full before:left-1/2 
                before:transform before:-translate-x-1/2 before:border-4 
                before:border-transparent before:border-t-slate-700 
                dark:before:border-t-slate-600
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

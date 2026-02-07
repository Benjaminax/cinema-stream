import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
    rightElement?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    icon,
    rightElement,
    className = '',
    ...props
}) => {
    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-medium text-gray-400 mb-2 ml-1">
                    {label}
                </label>
            )}
            <div className="relative group">
                {icon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-netflix-red transition-colors">
                        {icon}
                    </div>
                )}
                <input
                    className={`
            w-full bg-netflix-black border border-gray-800 rounded-lg 
            ${icon ? 'pl-10' : 'pl-4'} ${rightElement ? 'pr-20' : 'pr-4'} py-3 
            text-white placeholder-gray-600
            focus:outline-none focus:border-netflix-red focus:ring-1 focus:ring-netflix-red
            transition-all duration-300
            disabled:opacity-50 disabled:bg-gray-900
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
            ${className}
          `}
                    {...props}
                />
                {rightElement && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        {rightElement}
                    </div>
                )}
            </div>
            {error && (
                <p className="mt-1 text-sm text-red-500">{error}</p>
            )}
        </div>
    );
};

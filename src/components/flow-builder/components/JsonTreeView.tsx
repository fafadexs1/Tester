"use client";

import React from 'react';

interface JsonTreeViewProps {
    data: any;
    onSelectPath: (path: string) => void;
    currentPath?: string[];
}

export const JsonTreeView: React.FC<JsonTreeViewProps> = ({ data, onSelectPath, currentPath = [] }) => {
    if (typeof data !== 'object' || data === null) {
        return <span className="text-blue-500">{JSON.stringify(data)}</span>;
    }

    return (
        <div className="pl-4">
            {Array.isArray(data) ? (
                data.map((item, index) => (
                    <div key={index}>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onSelectPath([...currentPath, String(index)].join('.'));
                            }}
                            className="text-amber-500 hover:underline cursor-pointer focus:outline-none text-left text-xs"
                            title={`Clique para selecionar o caminho: ${[...currentPath, String(index)].join('.')}`}
                        >
                            [{index}]
                        </button>
                        <span className="text-gray-500 ml-1">-</span>
                        <JsonTreeView data={item} onSelectPath={onSelectPath} currentPath={[...currentPath, String(index)]} />
                    </div>
                ))
            ) : (
                Object.entries(data).map(([key, value]) => (
                    <div key={key}>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onSelectPath([...currentPath, key].join('.'));
                            }}
                            className="text-red-500 hover:underline cursor-pointer focus:outline-none text-left"
                            title={`Clique para selecionar o caminho: ${[...currentPath, key].join('.')}`}
                        >
                            "{key}":
                        </button>
                        <span className="ml-1">
                            {typeof value === 'object' && value !== null ? (
                                <JsonTreeView data={value} onSelectPath={onSelectPath} currentPath={[...currentPath, key]} />
                            ) : (
                                <span className="text-green-600">{JSON.stringify(value)}</span>
                            )}
                        </span>
                    </div>
                ))
            )}
        </div>
    );
};

import React from 'react';
import { Warp, type WarpProps } from '@paper-design/shaders-react';

export default function WarpBackground(props: WarpProps) {
    
    const defaultProps: WarpProps = {
        speed: 3.5,
        rotation: 4.5,
        // Configurar colores verdes para el shader
        colors: ['#65BB45', '#4A9B35', '#2D5A1F'], // Gradiente verde
        style: { 
            width: '100%', 
            height: '100%',
            position: 'fixed',
            top: 0,
            left: 0,
            zIndex: -1
        }
    };

    return (
        <Warp 
            {...defaultProps} 
            {...props} 
            style={{ 
                ...defaultProps.style, 
                ...props.style 
            }} 
        />
    );
}

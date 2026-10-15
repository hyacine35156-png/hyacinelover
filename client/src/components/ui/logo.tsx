import React from 'react';
import { toProxyImage } from '@client/src/utils/image-proxy';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className }) => (
  <img
    src={toProxyImage('https://aka.doubaocdn.com/s/4SC9XBO4jZ')}
    alt="Hyacine"
    className={`object-cover overflow-hidden ${className || ''}`}
    draggable={false}
  />
);

export default Logo;

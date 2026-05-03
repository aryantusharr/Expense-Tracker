import { motion } from 'framer-motion';
import './Header.css';

export default function Header({ title, subtitle, rightAction }) {
  return (
    <motion.header
      className="app-header"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="header-inner">
        <div className="header-text">
          <h1 className="header-title">{title}</h1>
          {subtitle && <p className="header-subtitle">{subtitle}</p>}
        </div>
        {rightAction && <div className="header-action">{rightAction}</div>}
      </div>
    </motion.header>
  );
}

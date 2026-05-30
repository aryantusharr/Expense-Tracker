import { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import './SwipeableItem.css';

export default function SwipeableItem({ children, isSwiped, onSwipeChange, onDelete, onEdit }) {
  const x = useMotionValue(0);
  const bgOpacity = useTransform(x, [-120, -60, 0], [1, 0.8, 0]);
  const constraintsRef = useRef(null);

  return (
    <div className="swipeable-container" ref={constraintsRef}>
      <motion.div className="swipeable-actions" style={{ opacity: bgOpacity }}>
        {onEdit && (
          <button className="swipe-btn swipe-edit" onClick={onEdit}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
        )}
        <button className="swipe-btn swipe-delete" onClick={onDelete}>
          🗑️
        </button>
      </motion.div>
      <motion.div
        className="swipeable-content"
        drag="x"
        dragConstraints={{ left: -140, right: 0 }}
        dragElastic={0.05}
        style={{ x }}
        animate={{ x: isSwiped ? -140 : 0 }}
        onDragEnd={(_, info) => {
          const threshold = -40;
          const velocity = info.velocity.x;
          if (info.offset.x < threshold || velocity < -500) {
            onSwipeChange?.(true);
          } else {
            onSwipeChange?.(false);
          }
        }}
        onClick={() => isSwiped && onSwipeChange?.(false)}
        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
      >
        {children}
      </motion.div>
    </div>
  );
}

"use client";

// components/shared/LoadingBar.tsx — top loading bar that shows on navigation.
// Uses Next.js route change events + a 1.5s minimum display.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export function LoadingBar() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, [pathname]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ width: "0%", opacity: 1 }}
          animate={{ width: "100%" }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="fixed top-0 right-0 z-[100] h-1 bg-primary"
          style={{ boxShadow: "0 0 10px var(--primary)" }}
        />
      )}
    </AnimatePresence>
  );
}

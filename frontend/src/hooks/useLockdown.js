import { useEffect, useState, useCallback } from 'react';

export const useLockdown = (onViolation, elementRef) => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    
    const requestFullscreen = useCallback(async () => {
        try {
            const elem = elementRef?.current || document.documentElement;
            if (elem.requestFullscreen) {
                await elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
                await elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) {
                await elem.msRequestFullscreen();
            }
            setIsFullscreen(true);
        } catch (err) {
            console.error("Fullscreen failed", err);
        }
    }, [elementRef]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                onViolation('tab_switch', 'medium', 'User switched tabs or minimized window');
            }
        };

        const handleBlur = () => {
            onViolation('focus_loss', 'low', 'Browser window lost focus');
        };

        const handleFullscreenChange = () => {
            if (!document.fullscreenElement) {
                setIsFullscreen(false);
                onViolation('fullscreen_exit', 'high', 'User exited fullscreen mode');
            }
        };

        const handleContextMenu = (e) => {
            e.preventDefault();
            onViolation('context_menu', 'low', 'Right-click attempted');
        };

        const handleKeyDown = (e) => {
            // Block Ctrl+C, Ctrl+V, Ctrl+U, F12
            if (
                (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'u')) ||
                e.key === 'F12'
            ) {
                e.preventDefault();
                onViolation('shortcut_blocked', 'medium', `Shortcut ${e.key} blocked`);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('contextmenu', handleContextMenu);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('contextmenu', handleContextMenu);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onViolation]);

    return { requestFullscreen, isFullscreen };
};

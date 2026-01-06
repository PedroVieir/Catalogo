// components/NavigationProgress.js
export default function NavigationProgress({ isActive }) {
    if (!isActive) return null;

    return (
        <div className="navigation-progress">
            <div className="progress-bar"></div>
        </div>
    );
}
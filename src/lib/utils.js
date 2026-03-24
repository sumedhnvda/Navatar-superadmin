import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function parseDate(date) {
  if (!date) return new Date();
  
  if (typeof date === 'object') {
    if (typeof date.toDate === 'function') {
      return date.toDate();
    } else if (date.seconds !== undefined) {
      return new Date(date.seconds * 1000);
    }
  }

  if (typeof date === 'string') {
    // Handles string format from console like "March 24, 2026 at 12:00:00 AM"
    const fixed = date.replace(" at ", " ");
    return new Date(fixed);
  }

  return new Date(date);
}

export function formatDate(date) {
  const d = parseDate(date);
  if (isNaN(d.getTime())) return "Invalid Date";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date) {
  const d = parseDate(date);
  if (isNaN(d.getTime())) return "Invalid Date";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getRelativeTime(date) {
  const d = parseDate(date);
  if (isNaN(d.getTime())) return "Invalid Date";
  const now = new Date();
  const diff = now - d;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

export function getStatusColor(status) {
  const colors = {
    new: "bg-blue-100 text-blue-700 border-blue-200",
    contacted: "bg-yellow-100 text-yellow-700 border-yellow-200",
    meeting_scheduled: "bg-purple-100 text-purple-700 border-purple-200",
    completed: "bg-green-100 text-green-700 border-green-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
  };
  return colors[status] || colors.new;
}

export function getMeetingStatusColor(status) {
  const colors = {
    scheduled: "bg-blue-100 text-blue-700 border-blue-200",
    completed: "bg-green-100 text-green-700 border-green-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
    follow_up: "bg-orange-100 text-orange-700 border-orange-200",
  };
  return colors[status] || colors.scheduled;
}

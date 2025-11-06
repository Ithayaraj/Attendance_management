export const parseTime = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

export const addMinutes = (timeStr, minutesToAdd) => {
  const totalMinutes = parseTime(timeStr) + minutesToAdd;
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const isTimeInRange = (currentTime, startTime, endTime, graceMinutes = 10) => {
  const current = parseTime(currentTime);
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  const graceEnd = start + graceMinutes;

  return {
    isBeforeGrace: current <= graceEnd,
    isBeforeEnd: current <= end,
    isAfterEnd: current > end
  };
};

export const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatTime = (date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

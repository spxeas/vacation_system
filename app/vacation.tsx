import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { submitVacationRequest } from "../lib/orderingApi";

const UPCOMING_DAYS = 30;
const TIMEZONE_OFFSET_HOURS = 8;
const TIMEZONE_OFFSET_MS = TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"] as const;

type DayOption = {
  dayNumber: number;
  iso: string;
  label: string;
};

type TimeSlot = {
  start: string;
  end: string;
};

type SelectedDates = Record<string, TimeSlot>;

const TIME_OPTIONS = [
  "06:00",
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
  "23:00",
];

const createDefaultTimeSlot = (): TimeSlot => ({ start: "09:00", end: "18:00" });

const getTimezoneDayNumber = (timestamp: number) =>
  Math.floor((timestamp + TIMEZONE_OFFSET_MS) / MS_PER_DAY);

const formatDayNumberISO = (dayNumber: number) => {
  const date = new Date(dayNumber * MS_PER_DAY);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDayNumberDisplay = (dayNumber: number) => {
  const iso = formatDayNumberISO(dayNumber);
  const [, month, day] = iso.split("-");
  const weekday = WEEKDAY_LABELS[new Date(dayNumber * MS_PER_DAY).getUTCDay()];
  return `${Number(month)}/${Number(day)} (${weekday})`;
};

const formatIsoForConfirmation = (iso: string) => {
  const [, month, day] = iso.split("-");
  return `${Number(month)}/${Number(day)}`;
};

const getNextTimeOption = (time: string) => {
  const index = TIME_OPTIONS.indexOf(time);
  if (index === -1 || index + 1 >= TIME_OPTIONS.length) {
    return null;
  }
  return TIME_OPTIONS[index + 1];
};

const getPreviousTimeOption = (time: string) => {
  const index = TIME_OPTIONS.indexOf(time);
  if (index <= 0) {
    return null;
  }
  return TIME_OPTIONS[index - 1];
};

const parseIsoToDayNumber = (iso: string) =>
  Math.floor(Date.parse(`${iso}T00:00:00.000Z`) / MS_PER_DAY);

const formatIsoForDisplay = (iso: string) =>
  formatDayNumberDisplay(parseIsoToDayNumber(iso));

export default function VacationScreen() {
  const router = useRouter();
  const { employeeId } = useLocalSearchParams<{ employeeId?: string }>();

  const todayDayNumber = useMemo(
    () => getTimezoneDayNumber(Date.now()),
    []
  );

  const todayLabel = useMemo(
    () => formatDayNumberDisplay(todayDayNumber),
    [todayDayNumber]
  );

  const currentWeekStart = useMemo(() => {
    const dayOfWeek = new Date(todayDayNumber * MS_PER_DAY).getUTCDay();
    return todayDayNumber - dayOfWeek;
  }, [todayDayNumber]);

  const currentWeekEnd = useMemo(
    () => currentWeekStart + 6,
    [currentWeekStart]
  );

  const nextWeekStart = useMemo(
    () => currentWeekStart + 7,
    [currentWeekStart]
  );

  const nextWeekEnd = useMemo(
    () => nextWeekStart + 6,
    [nextWeekStart]
  );

  const upcomingDays = useMemo<DayOption[]>(() => {
    return Array.from({ length: UPCOMING_DAYS }, (_, index) => {
      const dayNumber = todayDayNumber + index;
      return {
        dayNumber,
        iso: formatDayNumberISO(dayNumber),
        label: formatDayNumberDisplay(dayNumber),
      };
    });
  }, [todayDayNumber]);

  const [selectedDates, setSelectedDates] = useState<SelectedDates>({});
  const [activeTimePicker, setActiveTimePicker] = useState<
    { iso: string; field: "start" | "end" } | null
  >(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const employeeIdNumber = useMemo(() => {
    if (!employeeId) {
      return null;
    }
    const parsed = Number(employeeId);
    return Number.isFinite(parsed) ? parsed : null;
  }, [employeeId]);

  const sortedSelectedDates = useMemo(
    () =>
      Object.entries(selectedDates)
        .map(([iso, timeSlot]) => ({
          iso,
          timeSlot,
          displayLabel: formatIsoForDisplay(iso),
        }))
        .sort((a, b) => (a.iso < b.iso ? -1 : 1)),
    [selectedDates]
  );

  const activePickerOptions = useMemo(() => {
    if (!activeTimePicker) {
      return [] as string[];
    }

    const slot = selectedDates[activeTimePicker.iso];
    if (!slot) {
      return [] as string[];
    }

    if (activeTimePicker.field === "start") {
      return TIME_OPTIONS.filter((time) => time < slot.end);
    }

    return TIME_OPTIONS.filter((time) => time > slot.start);
  }, [activeTimePicker, selectedDates]);

  const isDateSelectable = useCallback(
    (dayNumber: number) => {
      if (dayNumber < todayDayNumber) {
        return false;
      }

      if (dayNumber >= currentWeekStart && dayNumber <= currentWeekEnd) {
        return false;
      }

      if (dayNumber >= nextWeekStart && dayNumber <= nextWeekEnd) {
        return todayDayNumber <= currentWeekEnd;
      }

      return true;
    },
    [
      todayDayNumber,
      currentWeekStart,
      currentWeekEnd,
      nextWeekStart,
      nextWeekEnd,
    ]
  );

  const toggleDate = useCallback(
    (day: DayOption) => {
      if (!isDateSelectable(day.dayNumber)) {
        setFeedback("下週的排休需在本週六前設定，請改選其他日期。");
        return;
      }

      setFeedback(null);
      setSelectedDates((current) => {
        if (current[day.iso]) {
          const { [day.iso]: _removed, ...rest } = current;
          return rest;
        }
        return {
          ...current,
          [day.iso]: createDefaultTimeSlot(),
        };
      });
    },
    [isDateSelectable]
  );

  const handleTimeOptionSelect = useCallback(
    (time: string) => {
      if (!activeTimePicker) {
        return;
      }

      const { iso, field } = activeTimePicker;

      setSelectedDates((current) => {
        const slot = current[iso];
        if (!slot) {
          return current;
        }

        if (field === "start") {
          const adjustedEnd =
            slot.end <= time ? getNextTimeOption(time) ?? slot.end : slot.end;
          return {
            ...current,
            [iso]: {
              start: time,
              end: adjustedEnd,
            },
          };
        }

        const adjustedStart =
          slot.start >= time
            ? getPreviousTimeOption(time) ?? slot.start
            : slot.start;
        return {
          ...current,
          [iso]: {
            start: adjustedStart,
            end: time,
          },
        };
      });

      setActiveTimePicker(null);
    },
    [activeTimePicker]
  );

  const closeTimePicker = useCallback(() => setActiveTimePicker(null), []);

  const handleSubmit = useCallback(async () => {
    if (!employeeIdNumber) {
      setFeedback("缺少員工編號，請重新登入後再試一次。");
      return;
    }

    const selectedEntries = Object.entries(selectedDates);

    if (selectedEntries.length === 0) {
      setFeedback("請至少選擇一天想要休假");
      return;
    }

    const payload = selectedEntries.map(([iso, timeSlot]) => ({
      date: iso,
      start_time: timeSlot.start,
      end_time: timeSlot.end,
    }));

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const response = await submitVacationRequest(employeeIdNumber, payload);
      const friendly = response.requests
        .map((request) => {
          const dateLabel = formatIsoForConfirmation(request.vacation_date);
          return `${dateLabel} (${request.start_time} - ${request.end_time})`;
        })
        .join("、");

      setFeedback(friendly ? `已送出 ${friendly} 的休假申請` : "已成功送出休假申請");
      setSelectedDates({});
      setActiveTimePicker(null);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "送出休假申請時發生未知錯誤，請稍後再試。";
      setFeedback(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [employeeIdNumber, selectedDates]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/")}>
          <Text style={styles.backButton}>← 返回登入</Text>
        </TouchableOpacity>
        <Text style={styles.employeeLabel}>員工編號：{employeeId ?? ""}</Text>
      </View>

      <View style={styles.container}>
        <Text style={styles.title}>選擇休假日期</Text>
        <Text style={styles.subtitle}>今天 (GMT+8)：{todayLabel}</Text>
        <Text style={styles.ruleNote}>下週排休需於本週六前完成。</Text>

        <FlatList
          data={upcomingDays}
          keyExtractor={(item) => item.iso}
          numColumns={2}
          columnWrapperStyle={styles.column}
          renderItem={({ item }) => {
            const selectable = isDateSelectable(item.dayNumber);
            const isSelected = Boolean(selectedDates[item.iso]);
            return (
              <TouchableOpacity
                style={[
                  styles.dateCard,
                  isSelected && styles.dateCardSelected,
                  !selectable && styles.dateCardDisabled,
                ]}
                onPress={() => toggleDate(item)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dateText,
                    isSelected && styles.dateTextSelected,
                    !selectable && styles.dateTextDisabled,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.list}
        />

        {sortedSelectedDates.length > 0 ? (
          <View style={styles.timeSection}>
            <Text style={styles.timeSectionTitle}>設定休假時段</Text>
            {sortedSelectedDates.map(({ iso, timeSlot, displayLabel }) => (
              <View key={iso} style={styles.timeRow}>
                <Text style={styles.timeRowLabel}>{displayLabel}</Text>
                <View style={styles.timeRowSelectors}>
                  <TouchableOpacity
                    style={styles.timeSelector}
                    onPress={() =>
                      setActiveTimePicker({ iso, field: "start" })
                    }
                  >
                    <Text style={styles.timeSelectorCaption}>開始</Text>
                    <Text style={styles.timeSelectorValue}>{timeSlot.start}</Text>
                  </TouchableOpacity>
                  <Text style={styles.timeSeparator}>至</Text>
                  <TouchableOpacity
                    style={styles.timeSelector}
                    onPress={() => setActiveTimePicker({ iso, field: "end" })}
                  >
                    <Text style={styles.timeSelectorCaption}>結束</Text>
                    <Text style={styles.timeSelectorValue}>{timeSlot.end}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <TouchableOpacity
          style={[
            styles.submitButton,
            (isSubmitting || sortedSelectedDates.length === 0) &&
              styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isSubmitting || sortedSelectedDates.length === 0}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? "送出中..." : "送出休假申請"}
          </Text>
        </TouchableOpacity>

        {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
      </View>

      <Modal
        visible={Boolean(activeTimePicker)}
        transparent
        animationType="fade"
        onRequestClose={closeTimePicker}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeTimePicker} />
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              {activeTimePicker
                ? `${formatIsoForDisplay(activeTimePicker.iso)} 選擇${
                    activeTimePicker.field === "start" ? "開始" : "結束"
                  }時間`
                : ""}
            </Text>
            <ScrollView style={styles.modalOptions}>
              {activePickerOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.modalOptionButton}
                  onPress={() => handleTimeOptionSelect(option)}
                >
                  <Text style={styles.modalOptionText}>{option}</Text>
                </TouchableOpacity>
              ))}
              {activePickerOptions.length === 0 ? (
                <Text style={styles.modalEmpty}>沒有可選時間</Text>
              ) : null}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={closeTimePicker}
            >
              <Text style={styles.modalCancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f2f2f2",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  backButton: {
    color: "#2c72f6",
    fontSize: 16,
  },
  employeeLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  container: {
    flex: 1,
    margin: 16,
    padding: 24,
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#333",
    marginBottom: 4,
  },
  ruleNote: {
    fontSize: 14,
    color: "#555",
    marginBottom: 16,
  },
  list: {
    paddingBottom: 16,
  },
  column: {
    justifyContent: "space-between",
    marginBottom: 12,
  },
  dateCard: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d0d0d0",
    backgroundColor: "#fafafa",
    alignItems: "center",
    justifyContent: "center",
  },
  dateCardSelected: {
    backgroundColor: "#2c72f6",
    borderColor: "#1e56c5",
  },
  dateCardDisabled: {
    backgroundColor: "#ededed",
    borderColor: "#d9d9d9",
  },
  dateText: {
    fontSize: 16,
    color: "#1a1a1a",
  },
  dateTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
  dateTextDisabled: {
    color: "#8c8c8c",
  },
  timeSection: {
    marginTop: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e3e3e3",
  },
  timeSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  timeRowLabel: {
    fontSize: 15,
    color: "#333",
    flex: 1,
  },
  timeRowSelectors: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeSelector: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#d0d0d0",
    borderRadius: 8,
    minWidth: 88,
    marginHorizontal: 4,
  },
  timeSelectorCaption: {
    fontSize: 12,
    color: "#666",
  },
  timeSelectorValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  timeSeparator: {
    fontSize: 14,
    color: "#666",
    marginHorizontal: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  modalContainer: {
    width: "100%",
    maxHeight: 400,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    elevation: 6,
    zIndex: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  modalOptions: {
    marginBottom: 12,
  },
  modalOptionButton: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ededed",
  },
  modalOptionText: {
    fontSize: 16,
    color: "#2c72f6",
    textAlign: "center",
  },
  modalEmpty: {
    textAlign: "center",
    color: "#999",
    paddingVertical: 12,
  },
  modalCancelButton: {
    paddingVertical: 10,
  },
  modalCancelText: {
    textAlign: "center",
    fontSize: 16,
    color: "#ff6b6b",
  },
  submitButton: {
    backgroundColor: "#ff8c42",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: "#f3b182",
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  feedback: {
    marginTop: 20,
    textAlign: "center",
    fontSize: 16,
    color: "#2c72f6",
  },
});

import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";

const buildEmployeePasswords = () => {
  const entries = Array.from({ length: 10 }, (_, index) => {
    const id = String(index + 1);
    const password = index + 1 === 10 ? "1010" : id.repeat(4);
    return [id, password] as const;
  });

  return Object.fromEntries(entries) as Record<string, string>;
};

export default function EmployeeLoginScreen() {
  const router = useRouter();
  const employeePasswords = useMemo(buildEmployeePasswords, []);
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleLogin = () => {
    const trimmedId = employeeId.trim();
    const trimmedPassword = password.trim();

    if (!trimmedId || !trimmedPassword) {
      setFeedback("請輸入員工編號與密碼");
      return;
    }

    if (!employeePasswords[trimmedId]) {
      setFeedback("找不到此員工編號");
      return;
    }

    if (employeePasswords[trimmedId] === trimmedPassword) {
      setFeedback(null);
      setEmployeeId("");
      setPassword("");
      router.push({ pathname: "/vacation", params: { employeeId: trimmedId } });
    } else {
      setFeedback("密碼錯誤，請再試一次。");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View style={styles.content}>
          <Text style={styles.title}>員工登入</Text>

          <View style={styles.formField}>
            <Text style={styles.label}>員工編號</Text>
            <TextInput
              value={employeeId}
              onChangeText={setEmployeeId}
              keyboardType="number-pad"
              placeholder="請輸入 1 - 10"
              style={styles.input}
              maxLength={2}
            />
          </View>

          <View style={styles.formField}>
            <Text style={styles.label}>密碼</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="請輸入對應密碼"
              secureTextEntry
              style={styles.input}
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>登入</Text>
          </TouchableOpacity>

          {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f2f2f2",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  content: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 24,
  },
  formField: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fafafa",
  },
  button: {
    backgroundColor: "#2c72f6",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
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

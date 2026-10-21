import { type ReactNode } from 'react';
import { ScrollView } from 'react-native';

import { Banner, Screen } from '../../../shared/ui';
import { texts } from '../texts';
import detailStyles from './detailStyles';

type Props = {
  testID: string;
  policyId: string;
  error?: string | null;
  children: ReactNode;
};

export function AssistanceLayout({ testID, policyId, error, children }: Readonly<Props>) {
  return (
    <Screen testID={testID} header={{ title: texts.assistance.screenTitle }}>
      <ScrollView style={detailStyles.scroll} contentContainerStyle={detailStyles.content}>
        <Banner variant="success">{texts.assistance.coverageOk(policyId)}</Banner>
        {error ? <Banner variant="error">{error}</Banner> : null}
        {children}
      </ScrollView>
    </Screen>
  );
}

/*
 * Tanaguru - Automated webpage assessment
 * Copyright (C) 2008-2015 Tanaguru.org
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Contact us by mail: tanaguru AT tanaguru DOT org
 */
package org.tanaguru.rules.rgaa32016;

import java.util.HashMap;
import java.util.Map;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.jsoup.nodes.Element;
import org.tanaguru.entity.audit.TestSolution;
import org.tanaguru.processor.SSPHandler;
import org.tanaguru.ruleimplementation.AbstractPageRuleMarkupImplementation;
import org.tanaguru.ruleimplementation.ElementHandler;
import org.tanaguru.ruleimplementation.ElementHandlerImpl;
import org.tanaguru.ruleimplementation.TestSolutionHandler;
import org.tanaguru.rules.elementchecker.ElementChecker;
import org.tanaguru.rules.elementchecker.element.ElementPresenceChecker;
import org.tanaguru.rules.elementchecker.text.TextEmptinessChecker;
import org.tanaguru.rules.elementselector.SimpleElementSelector;
import org.tanaguru.rules.elementselector.builder.CssLikeSelectorBuilder;
import static org.tanaguru.rules.keystore.AttributeStore.ARIA_LABELLEDBY_ATTR;
import static org.tanaguru.rules.keystore.AttributeStore.ID_ATTR;
import static org.tanaguru.rules.keystore.CssLikeQueryStore.INPUT_ELEMENT_WITH_ARIA_INSIDE_FORM_CSS_LIKE_QUERY;
import static org.tanaguru.rules.keystore.HtmlElementStore.FORM_ELEMENT;
import static org.tanaguru.rules.keystore.RemarkMessageStore.ARIA_LABELLEDBY_EMPTY_MSG;
import static org.tanaguru.rules.keystore.RemarkMessageStore.FORM_ELEMENT_WITHOUT_LABEL_MSG;
import static org.tanaguru.rules.keystore.RemarkMessageStore.FORM_ELEMENT_WITH_NOT_UNIQUE_LABEL_MSG;
import org.tanaguru.rules.textbuilder.TextAttributeOfElementBuilder;

/**
 * Implementation of the rule 11.1.3 of the referential Rgaa 3-2016.
 * <br>
 * For more details about the implementation, refer to <a
 * href="http://tanaguru-rules-rgaa3.readthedocs.org/en/latest/Rule-11-1-3">the rule 11.1.3
 * design page.</a>
 *
 * @see <a
 * href="http://references.modernisation.gouv.fr/referentiel-technique-0#test-11-1-3">
 * 11.1.3 rule specification</a>
 *
 */
public class Rgaa32016Rule110103 extends AbstractPageRuleMarkupImplementation {

    private SimpleElementSelector selector;
    private final ElementHandler<Element> inputElementHandler = new ElementHandlerImpl();
    private final Map<Element, ElementHandler<Element>> inputFormMap = new HashMap<>();

    /**
     * Default constructor
     */
    public Rgaa32016Rule110103() {
        super();
    }

    @Override
    protected void select(SSPHandler sspHandler) {
        selector = new SimpleElementSelector(INPUT_ELEMENT_WITH_ARIA_INSIDE_FORM_CSS_LIKE_QUERY);
        selector.selectElements(
                sspHandler,
                inputElementHandler);
        putInputElementHandlerIntoTheMap();
    }

    @Override
    public int getSelectionSize() {
        return inputElementHandler.get().size();
    }

    @Override
    protected void check(
            SSPHandler sspHandler,
            TestSolutionHandler testSolutionHandler) {

        /* If the page has no input form element, the test is not applicable */
        if (inputFormMap.entrySet().isEmpty()) {
            testSolutionHandler.addTestSolution(TestSolution.NOT_APPLICABLE);
            return;
        }

        for (Map.Entry<Element, ElementHandler<Element>> entry : inputFormMap.entrySet()) {
            /* The attribute Emptiness Checker. Keep default value i.e failed 
             when attribute is empty
             */
            ElementChecker attributeEmptinessChecker
                    = new TextEmptinessChecker(
                            new TextAttributeOfElementBuilder(ARIA_LABELLEDBY_ATTR),
                            ARIA_LABELLEDBY_EMPTY_MSG,
                            null);
            attributeEmptinessChecker.check(sspHandler, entry.getValue(), testSolutionHandler);

            ElementHandler<Element> inputWithoutLabel = new ElementHandlerImpl();
            ElementHandler<Element> notUniqueLabel = new ElementHandlerImpl();
            for (Element el : entry.getValue().get()) {
                if (StringUtils.isNotEmpty(el.attr(ARIA_LABELLEDBY_ATTR))) {
                    ElementHandler<Element> labelHandler = new ElementHandlerImpl();
                    if (!el.attr(ARIA_LABELLEDBY_ATTR).isEmpty()) {
                        String[] labeledbyValues = el.attr(ARIA_LABELLEDBY_ATTR).split(" ");
                        if (labeledbyValues.length > 0) {
                            for (String labledByValue : labeledbyValues) {
                                if (!labledByValue.isEmpty()) {
                                    labelHandler.addAll(entry.getKey().select(CssLikeSelectorBuilder
                                            .buildSelectorFromAttributeTypeAndValue(ID_ATTR, labledByValue)));
                                    if (labelHandler.get().isEmpty()) {
                                        inputWithoutLabel.add(el);
                                    } else if (labelHandler.get().size() > 1) {
                                        notUniqueLabel.add(el);
                                        notUniqueLabel.addAll(labelHandler.get());
                                    }
                                   
                                    labelHandler.clean();
                                }
                            }
                        }
                    }
                }
            }
           

            /* Check if the form element has a label associated */
            ElementChecker elementPresenceChecker
                    = new ElementPresenceChecker(
                            new ImmutablePair(TestSolution.FAILED,FORM_ELEMENT_WITHOUT_LABEL_MSG),
                            new ImmutablePair(TestSolution.PASSED,""));
            elementPresenceChecker.check(sspHandler, inputWithoutLabel, testSolutionHandler);

            /* Check if the id attr of the label associated to the form element is unique */
            elementPresenceChecker
                    = new ElementPresenceChecker(
                            new ImmutablePair(TestSolution.FAILED,FORM_ELEMENT_WITH_NOT_UNIQUE_LABEL_MSG),
                            new ImmutablePair(TestSolution.PASSED,""));
            elementPresenceChecker.check(sspHandler, notUniqueLabel, testSolutionHandler);
        }
    }

    /**
     * This method linked each input on a page to its form in a map.
     */
    private void putInputElementHandlerIntoTheMap() {
        for (Element el : inputElementHandler.get()) {
            Element tmpElement = el.parent();
            while (StringUtils.isNotBlank(tmpElement.tagName())) {
                if (tmpElement.tagName().equals(FORM_ELEMENT)) {
                    if (inputFormMap.containsKey(tmpElement)) {
                        inputFormMap.get(tmpElement).add(el);
                    } else {
                        ElementHandler<Element> inputElement = new ElementHandlerImpl();
                        inputElement.add(el);
                        inputFormMap.put(tmpElement, inputElement);
                    }
                    break;
                }
                tmpElement = tmpElement.parent();
            }
        }
    }

}
